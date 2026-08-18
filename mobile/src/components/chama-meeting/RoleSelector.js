import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RoleSelector = ({ availableRoles, selectedRole, onSelectRole, formErrors, showErrors, colors, invitationMode }) => {
  return (
    <View style={[styles.roleCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
      <View style={styles.roleHeader}>
        <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
        <View style={styles.roleHeaderText}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Assign Role
          </Text>
          <Text style={[styles.roleSubtitle, { color: colors.textSecondary }]}>
            Choose the role for {invitationMode === 'email' ? 'this invitation' : 'selected users'}
          </Text>
        </View>
      </View>

      <View style={styles.roleOptions}>
        {availableRoles.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.roleOption,
              {
                backgroundColor: selectedRole === role.id ? colors.primary + '15' : colors.background,
                borderColor: selectedRole === role.id ? colors.primary : colors.border,
              }
            ]}
            onPress={() => {
              onSelectRole(role.id);
              if (formErrors.role) {
                formErrors.role = undefined;
              }
            }}
          >
            <View style={[
              styles.roleIconContainer,
              { backgroundColor: selectedRole === role.id ? colors.primary : colors.textSecondary }
            ]}>
              <Ionicons
                name={role.icon}
                size={20}
                color="white"
              />
            </View>
            <View style={styles.roleInfo}>
              <Text style={[
                styles.roleName,
                { color: selectedRole === role.id ? colors.primary : colors.text }
              ]}>
                {role.name}
              </Text>
              <Text style={[styles.roleDescription, { color: colors.textSecondary }]}>
                {role.description}
              </Text>
            </View>
            {selectedRole === role.id && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {showErrors && formErrors.role && (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {formErrors.role}
        </Text>
      )}
    </View>
  );
};

const styles = {
  roleCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
  },
  roleOptions: {
    gap: 12,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  roleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
  },
};

export default RoleSelector;
