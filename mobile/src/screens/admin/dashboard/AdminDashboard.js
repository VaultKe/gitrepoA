import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import AdminLayoutProvider from '../../../components/admin/AdminLayoutProvider';

export default function AdminDashboard({ route, navigation }) {
  const { theme } = useApp();
  const nav = navigation || useNavigation();
  const colors = getThemeColors(theme);

  // For demo purposes, allow all users to access admin dashboard
  // In production, you would check userRole === 'admin'
  const hasAdminAccess = true; // Change to: userRole === 'admin'

  if (!hasAdminAccess) {
    return (
      <View style={[styles.accessDeniedContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.accessDeniedContent, { backgroundColor: colors.surface }]}>
          <Ionicons name="shield-off" size={64} color={colors.error} />
          <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
            Access Denied
          </Text>
          <Text style={[styles.accessDeniedMessage, { color: colors.textSecondary }]}>
            You don't have permission to access the admin dashboard.
            {'\n\n'}Contact your administrator for access.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => nav.navigate('User')}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Back to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <AdminLayoutProvider
      route={route}
      navigation={nav}
    />
  );
}

const styles = StyleSheet.create({
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  accessDeniedContent: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
