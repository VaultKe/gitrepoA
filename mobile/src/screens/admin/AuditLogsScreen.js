import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';

const AuditLogsScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
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
    >
      {/* Content starts here - header handled by navigator */}

      {/* Content */}
      <View style={styles.section}>
        <Card style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.comingSoon}>
            <Ionicons name="list" size={64} color={colors.primary} />
            <Text style={[styles.comingSoonTitle, { color: colors.text }]}>
              Audit Logs
            </Text>
            <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
              Track admin actions, security events, and system changes with detailed audit trails.
            </Text>
          </View>
        </Card>
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
  card: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  comingSoon: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  comingSoonTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  comingSoonText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default AuditLogsScreen;
