import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import Card from '../../components/common/Card';

const NotificationManagementScreen = ({ navigation }) => {
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
            <Ionicons name="notifications" size={64} color={colors.primary} />
            <Text style={[styles.comingSoonTitle, { color: colors.text }]}>
              Notification Management
            </Text>
            <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
              Send system-wide notifications, manage notification templates, and track delivery status.
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

export default NotificationManagementScreen;
