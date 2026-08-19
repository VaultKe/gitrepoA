import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../utils/theme';

const TabNavigation = ({
  colors,
  isDesktop,
  activeTab,
  onTabChange,
  onOpenCreateModal,
  canCreatePolls,
}) => {
  return (
    <View style={[
      styles.tabContainer,
      { backgroundColor: colors.surface },
      isDesktop && styles.tabContainerDesktop
    ]}>
      <View style={[styles.buttonGroup, { backgroundColor: colors.border + '20', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.groupButton,
            activeTab === 'active' && styles.groupButtonActive,
            { backgroundColor: activeTab === 'active' ? colors.primary : 'transparent' },
            isDesktop && styles.groupButtonDesktop
          ]}
          onPress={() => onTabChange('active')}
          accessibilityLabel={`View active polls. ${activeTab === 'active' ? 'Currently selected' : 'Not selected'}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'active' }}
        >
          <Ionicons
            name="time"
            size={isDesktop ? 20 : 16}
            color={activeTab === 'active' ? colors.surface : colors.textSecondary}
          />
          <Text style={[
            styles.groupButtonText,
            { color: activeTab === 'active' ? colors.surface : colors.textSecondary },
            isDesktop && styles.groupButtonTextDesktop
          ]}>
            Active Polls
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.groupButton,
            activeTab === 'completed' && styles.groupButtonActive,
            { backgroundColor: activeTab === 'completed' ? colors.primary : 'transparent' },
            isDesktop && styles.groupButtonDesktop
          ]}
          onPress={() => onTabChange('completed')}
          accessibilityLabel={`View completed polls. ${activeTab === 'completed' ? 'Currently selected' : 'Not selected'}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'completed' }}
        >
          <Ionicons
            name="checkmark-circle"
            size={isDesktop ? 20 : 16}
            color={activeTab === 'completed' ? colors.surface : colors.textSecondary}
          />
          <Text style={[
            styles.groupButtonText,
            { color: activeTab === 'completed' ? colors.surface : colors.textSecondary },
            isDesktop && styles.groupButtonTextDesktop
          ]}>
            Completed
          </Text>
        </TouchableOpacity>

        {canCreatePolls() && (
          <TouchableOpacity
            style={[
              styles.groupButton,
              { backgroundColor: colors.primary, borderRadius: 8 },
              isDesktop && styles.groupButtonDesktop
            ]}
            onPress={onOpenCreateModal}
            activeOpacity={0.8}
            accessibilityLabel="Create new poll"
            accessibilityRole="button"
          >
            <Ionicons
              name="add"
              size={isDesktop ? 20 : 16}
              color={colors.surface}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabContainerDesktop: {
    borderRadius: 12,
    padding: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
  },
  groupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    marginHorizontal: 2,
  },
  groupButtonActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupButtonDesktop: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 120,
  },
  groupButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  groupButtonTextDesktop: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TabNavigation;
