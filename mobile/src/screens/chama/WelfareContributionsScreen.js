import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useChamaContext } from '../../context/ChamaContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import Card from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ApiService from '../../services/api';

const createTableStyles = (colors, spacing, typography, shadows) => ({
  tableContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  nameCell: {
    flex: 2.5,
    alignItems: 'flex-start',
  },
  amountCell: {
    flex: 1.2,
  },
  dateCell: {
    flex: 1.5,
  },
  tableHeaderText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    fontSize: 9,
    textAlign: 'center',
  },
  tableCellText: {
    fontSize: 8.5,
    color: colors.text,
    textAlign: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  nameText: {
    fontWeight: typography.fontWeight.medium,
    textAlign: 'left',
  },
});

const WelfareContributionsScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);
  const tableStyles = createTableStyles(colors, spacing, typography, shadows);
  const { welfareRequestId, chamaId } = route?.params || {};

  const [welfareRequest, setWelfareRequest] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    if (welfareRequestId) {
      loadWelfareRequestDetails();
      loadContributions();
    }
  }, [welfareRequestId]);

  // Handle pagination
  useEffect(() => {
    if (contributions.length > 0) {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setContributions(contributions.slice(startIndex, endIndex));
    }
  }, [currentPage, contributions]);

  const loadWelfareRequestDetails = async () => {
    try {
      const response = await ApiService.getWelfareRequests(chamaId);
      if (response.success) {
        const request = response.data?.find(r => r.id === welfareRequestId);
        setWelfareRequest(request);
      }
    } catch (error) {
      console.error('Error loading welfare request details:', error);
      Alert.alert('Error', 'Failed to load welfare request details');
    }
  };

  const loadContributions = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getWelfareContributions(welfareRequestId);
      if (response.success) {
        const contribs = response.data || [];
        setContributions(contribs);
        setTotalItems(contribs.length);
        setTotalPages(Math.ceil(contribs.length / pageSize));

        // Set initial page data
        const startIndex = 0;
        const endIndex = pageSize;
        setContributions(contribs.slice(startIndex, endIndex));
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error loading contributions:', error);
      Alert.alert('Error', 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'KES 0';
    }
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getContributorDisplayName = (contribution) => {
    if (!contribution.contributor) return 'Unknown Contributor';

    const contributor = contribution.contributor;
    const userData = contributor.user || contributor;
    const firstName = userData.first_name || contributor.first_name || userData.firstName || '';
    const lastName = userData.last_name || contributor.last_name || userData.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || userData.name || contributor.name || userData.email?.split('@')[0] || contributor.email?.split('@')[0] || 'Unknown Contributor';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!welfareRequest) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorState}>
          <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Welfare Request Not Found</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.requestIcon}>
              <Ionicons name="heart" size={32} color={colors.primary} />
            </View>
            <View style={styles.requestInfo}>
              <Text style={[styles.requestTitle, { color: colors.text }]}>
                Contributions to {welfareRequest.title?.slice(0, 20)}...
              </Text>
              <Text style={[styles.requestAmount, { color: colors.success }]}>
                Target: {formatCurrency(welfareRequest.amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Contributions Table */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.md }]}>Contribution Details</Text>
        <View style={styles.contributionsTable}>
          {/* Table Header */}
          <View style={tableStyles.tableHeader}>
            <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
              <Text style={[tableStyles.tableHeaderText, { textAlign: 'left' }]}>Contributor</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={tableStyles.tableHeaderText}>Date</Text>
            </View>
          </View>

          {/* Table Body */}
          {contributions.map((contribution, index) => (
            <View
              key={contribution.id}
              style={[
                tableStyles.tableRow,
                index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }
              ]}
            >
              {/* Contributor */}
              <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
                <View style={tableStyles.nameContainer}>
                  <View style={[tableStyles.typeIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons
                      name="person"
                      size={12}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[tableStyles.tableCellText, tableStyles.nameText]} numberOfLines={1}>
                    {getContributorDisplayName(contribution)}
                  </Text>
                </View>
              </View>

              {/* Amount */}
              <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
                <Text style={[tableStyles.tableCellText, { fontWeight: typography.fontWeight.medium, color: colors.success }]}>
                  {formatCurrency(contribution.amount)}
                </Text>
              </View>

              {/* Date */}
              <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
                <Text style={tableStyles.tableCellText}>
                  {formatDate(contribution.createdAt || contribution.created_at)}
                </Text>
              </View>
            </View>
          ))}

          {/* Pagination */}
          {totalItems > pageSize && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={24} color={currentPage === 1 ? colors.textTertiary : colors.primary} />
              </TouchableOpacity>

              <Text style={styles.paginationInfo}>
                Page {currentPage} of {totalPages} ({totalItems} total)
              </Text>

              <TouchableOpacity
                style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <Ionicons name="chevron-forward" size={24} color={currentPage === totalPages ? colors.textTertiary : colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  contributionsTable: {
    marginTop: spacing.md,
  },
  header: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  requestInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  requestAmount: {
    fontSize: typography.fontSize.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: spacing.sm,
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationInfo: {
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
    fontWeight: typography.fontWeight.medium,
    minWidth: 60,
    textAlign: 'center',
  },
});

export default WelfareContributionsScreen;