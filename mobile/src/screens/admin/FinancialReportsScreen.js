import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';
import BorderedButton from '../../components/BorderedButton';
import { ButtonGrid } from '../../components/ButtonGroup';

const { width } = Dimensions.get('window');

const FinancialReportsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState({
    totalRevenue: 2450000,
    totalTransactions: 15623,
    averageTransactionValue: 156.8,
    monthlyGrowth: 12.5,
    topChamas: [
      { name: 'Savings Circle A', revenue: 450000, transactions: 234 },
      { name: 'Investment Group B', revenue: 380000, transactions: 189 },
      { name: 'Community Fund C', revenue: 320000, transactions: 156 },
    ],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setReportData({
        ...reportData,
        totalRevenue: Math.floor(Math.random() * 1000000) + 2000000,
        totalTransactions: Math.floor(Math.random() * 5000) + 15000,
      });
      setRefreshing(false);
    }, 1500);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };



  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Content starts here - header handled by navigator */}

      {/* Key Metrics - User Dashboard Style */}
      <Card style={styles.statsCard}>
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="cash" size={20} color={colors.success} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Total Revenue
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {formatCurrency(reportData.totalRevenue)}
            </Text>
            <Text style={[styles.statTileSubtitle, { color: colors.textSecondary }]}>
              This month
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="receipt" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Total Transactions
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {reportData.totalTransactions.toLocaleString()}
            </Text>
            <Text style={[styles.statTileSubtitle, { color: colors.textSecondary }]}>
              All time
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.info + '15' }]}>
                <Ionicons name="trending-up" size={20} color={colors.info} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Avg Transaction
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {formatCurrency(reportData.averageTransactionValue)}
            </Text>
            <Text style={[styles.statTileSubtitle, { color: colors.textSecondary }]}>
              Per transaction
            </Text>
          </View>

          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statTileHeader}>
              <View style={[styles.statTileIcon, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="arrow-up" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>
                Monthly Growth
              </Text>
            </View>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              +{reportData.monthlyGrowth}%
            </Text>
            <Text style={[styles.statTileSubtitle, { color: colors.textSecondary }]}>
              vs last month
            </Text>
          </View>
        </View>
      </Card>

      {/* Top Performing Chamas */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Top Performing Chamas
        </Text>
        <Card style={[styles.chamasCard, { backgroundColor: colors.surface }]}>
          {reportData.topChamas.map((chama, index) => (
            <View key={index} style={styles.chamaItem}>
              <View style={styles.chamaInfo}>
                <Text style={[styles.chamaName, { color: colors.text }]}>
                  {chama.name}
                </Text>
                <Text style={[styles.chamaStats, { color: colors.textSecondary }]}>
                  {chama.transactions} transactions
                </Text>
              </View>
              <Text style={[styles.chamaRevenue, { color: colors.success }]}>
                {formatCurrency(chama.revenue)}
              </Text>
            </View>
          ))}
        </Card>
      </View>

      {/* Report Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Generate Reports
        </Text>
        <ButtonGrid spacing={8}>
          <BorderedButton
            title="Monthly Report"
            icon="document-text"
            variant="primary"
            size="small"
            onPress={() => console.log('Generate Monthly Report')}
            theme={theme}
            style={styles.reportButton}
          />
          <BorderedButton
            title="Analytics Report"
            icon="bar-chart"
            variant="secondary"
            size="small"
            onPress={() => console.log('Generate Analytics Report')}
            theme={theme}
            style={styles.reportButton}
          />
          <BorderedButton
            title="Revenue Report"
            icon="pie-chart"
            variant="info"
            size="small"
            onPress={() => console.log('Generate Revenue Breakdown')}
            theme={theme}
            style={styles.reportButton}
          />
          <BorderedButton
            title="Export Data"
            icon="download"
            variant="success"
            size="small"
            onPress={() => console.log('Export Data')}
            theme={theme}
            style={styles.reportButton}
          />
        </ButtonGrid>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  // User Dashboard Style Stats
  statsCard: {
    margin: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statTile: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statTileLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  statTileValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'left',
    marginBottom: spacing.xs,
  },
  statTileSubtitle: {
    fontSize: typography.fontSize.xs,
  },
  chamasCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  chamaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  chamaInfo: {
    flex: 1,
  },
  chamaName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  chamaStats: {
    fontSize: typography.fontSize.sm,
  },
  chamaRevenue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: (width - spacing.lg * 3) / 2,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // BorderedButton styles - RESPONSIVE
  reportButton: {
    width: Math.min((width - spacing.lg * 3) / 2, 160),
    marginBottom: spacing.md,
    maxWidth: 160,
  },
});

export default FinancialReportsScreen;
