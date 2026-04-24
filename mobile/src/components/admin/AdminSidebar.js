import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import ApiService from '../../services/api';

export default function AdminSidebar({ items, currentPage, onItemPress, onClose }) {
  const { theme, user, logout } = useApp();
  const colors = getThemeColors(theme);

  const handleLogout = async () => {
    // Show immediate feedback
    Toast.show({
      type: 'info',
      text1: 'Logging out...',
      text2: 'Please wait while we securely log you out',
    });

    try {
      // Call API logout if available
      try {
        await ApiService.logout();
      } catch (apiError) {
        console.warn('🔴 API logout failed, continuing with local logout:', apiError);
      }

      // Clear local data and logout
      await logout();
      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Logged out successfully',
        text2: 'You have been securely logged out',
      });

    } catch (error) {
      console.error('🔴 Admin logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: error.message || 'Please try again',
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={[styles.adminIcon, { backgroundColor: colors.warning }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.background} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Admin Panel
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {user?.firstName} {user?.lastName}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Navigation Items */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.navItem,
              currentPage === item.id && {
                backgroundColor: colors.primary + '20',
                borderRightWidth: 3,
                borderRightColor: colors.primary,
              },
            ]}
            onPress={() => onItemPress(item)}
          >
            <View style={styles.navItemContent}>
              <View style={[
                styles.iconContainer,
                currentPage === item.id && { backgroundColor: colors.primary + '30' }
              ]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={currentPage === item.id ? colors.primary : colors.textSecondary}
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[
                  styles.navItemTitle,
                  { color: currentPage === item.id ? colors.primary : colors.text }
                ]}>
                  {item.title}
                </Text>
                <Text style={[styles.navItemDescription, { color: colors.textSecondary }]}>
                  {item.description}
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.footerButton, { backgroundColor: colors.error + '20' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={20} color={colors.error} />
          <Text style={[styles.footerButtonText, { color: colors.error }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  adminIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  navItemTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  navItemDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});
