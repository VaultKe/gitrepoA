import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

const ViewMemberDetailsSection = ({ memberData, isCombined, isDesktop, formatDate, maskPhone, maskLocation, maskOccupation, getRoleColor, getRoleIcon, styles, colors }) => {
  if (!memberData) return null;
  return (
    <View style={[styles[isCombined ? 'combinedSectionContent' : 'detailsCardContent'], isCombined && isDesktop && styles.combinedSectionContentDesktop]}>
      <Text style={styles.combinedSectionTitle}>Member Details</Text>
      <View style={styles.detailsTableContainer}>
        <View style={styles.detailsTableHeader}>
          <Text style={styles.detailsTableHeaderText}>Item</Text>
          <Text style={styles.detailsTableHeaderText}>Details</Text>
        </View>
        <View style={styles.detailsTable}>
          <View style={styles.tableRowEven}>
            <Text style={styles.tableLabel}>Role</Text>
            <View style={styles.tableValue}>
              <Text style={styles.tableValueText}>{memberData.role?.charAt(0).toUpperCase() + memberData.role?.slice(1)}</Text>
            </View>
          </View>
          <View style={styles.tableRowOdd}>
            <Text style={styles.tableLabel}>Join Date</Text>
            <Text style={styles.tableValueText}>{formatDate(memberData.joined_at)}</Text>
          </View>
          <View style={styles.tableRowEven}>
            <Text style={styles.tableLabel}>Attendance Rate</Text>
            <Text style={styles.tableValueTextPrimary}>{memberData.attendance_rate?.toFixed(1) || 0}%</Text>
          </View>
          <View style={styles.tableRowOdd}>
            <Text style={styles.tableLabel}>Reputation</Text>
            <View style={styles.tableValue}>
              <Text style={styles.tableValueText}>{memberData.reputation_score?.toFixed(1) || 0}</Text>
            </View>
          </View>
          <View style={styles.tableRowEven}>
            <Text style={styles.tableLabel}>Total Contributions</Text>
            <Text style={styles.tableValueTextSuccess}>{memberData.total_contributions || 0}</Text>
          </View>
          {memberData.loan_balance > 0 && (
            <View style={styles.tableRowOdd}>
              <Text style={styles.tableLabel}>Loan Balance</Text>
              <Text style={styles.tableValueTextError}>{memberData.loan_balance}</Text>
            </View>
          )}
          {memberData.business_type && (
            <View style={styles.tableRowOdd}>
              <Text style={styles.tableLabel}>Business Type</Text>
              <Text style={styles.tableValueText}>{memberData.business_type}</Text>
            </View>
          )}
          {memberData.location && (
            <View style={styles.tableRowEven}>
              <Text style={styles.tableLabel}>Location</Text>
              <Text style={styles.tableValueText}>{maskLocation(memberData.location)}</Text>
            </View>
          )}
          {memberData.user?.phone && (
            <View style={styles.tableRowOdd}>
              <Text style={styles.tableLabel}>Phone</Text>
              <Text style={styles.tableValueText}>{maskPhone(memberData.user?.phone)}</Text>
            </View>
          )}
          {(memberData.user?.occupation || memberData.user?.bio) && (
            <View style={styles.tableRowEven}>
              <Text style={styles.tableLabel}>{memberData.user?.occupation ? 'Occupation' : 'Bio'}</Text>
              <Text style={styles.tableValueText}>{maskOccupation(memberData.user?.occupation || memberData.user?.bio)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default ViewMemberDetailsSection;
