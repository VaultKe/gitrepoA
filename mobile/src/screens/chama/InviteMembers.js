import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../context/AppContext';
import { getThemeColors } from '../../utils/theme';
import { spacing, typography, borderRadius, shadows } from '../../utils/theme';
import api from '../../services/api';

const InviteMembers = ({ route, navigation, onRouteChange }) => {
  const { chamaId, chamaName, userRole } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // User search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [invitationMode, setInvitationMode] = useState('email'); // 'email' or 'users'

  // Role assignment functionality
  const [selectedRole, setSelectedRole] = useState('member');
  const [userRoles, setUserRoles] = useState({}); // For individual user role assignments

  // Form validation
  const [formErrors, setFormErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  // Check if user has permission to invite
  const canInvite = ['chairperson', 'secretary', 'treasurer'].includes(userRole);

  // Role options with descriptions and permissions
  const roleOptions = [
    {
      id: 'member',
      name: 'Member',
      description: 'Regular member with basic privileges',
      icon: 'person',
      canBeAssignedBy: ['chairperson', 'secretary', 'treasurer']
    },
    {
      id: 'treasurer',
      name: 'Treasurer',
      description: 'Manages finances and transactions',
      icon: 'wallet',
      canBeAssignedBy: ['chairperson']
    },
    {
      id: 'secretary',
      name: 'Secretary',
      description: 'Keeps records and manages communications',
      icon: 'document-text',
      canBeAssignedBy: ['chairperson']
    },
  ];

  // Filter roles based on current user's permissions
  const availableRoles = roleOptions.filter(role =>
    role.canBeAssignedBy.includes(userRole)
  );

  // Security and validation functions
  const sanitizeInput = (value, type = 'text') => {
    if (!value) return '';

    switch (type) {
      case 'email':
        // Remove dangerous characters and normalize email
        return value.toString().toLowerCase().replace(/[<>\"'&]/g, '').trim().substring(0, 254);
      case 'phone':
        // Allow only numbers, spaces, hyphens, plus, and parentheses
        return value.toString().replace(/[^0-9\s\-+()]/g, '').trim().substring(0, 20);
      case 'message':
        // Remove potentially harmful characters but allow basic punctuation
        return value.toString().replace(/[<>\"'&]/g, '').trim().substring(0, 500);
      case 'name':
        // Allow only letters, numbers, spaces, and basic punctuation
        return value.toString().replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim().substring(0, 100);
      default:
        return value.toString().replace(/[<>\"'&]/g, '').trim().substring(0, 255);
    }
  };

  const validateField = (field, value) => {
    const errors = {};

    switch (field) {
      case 'email':
        if (!value || value.trim().length === 0) {
          errors.email = 'Email address is required';
        } else {
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(value.trim())) {
            errors.email = 'Please enter a valid email address';
          } else if (value.trim().length > 254) {
            errors.email = 'Email address is too long';
          }
        }
        break;

      case 'phone':
        if (value && value.trim().length > 0) {
          const phoneRegex = /^[\+]?[0-9\s\-()]{7,20}$/;
          if (!phoneRegex.test(value.trim())) {
            errors.phone = 'Please enter a valid phone number';
          }
        }
        break;

      case 'message':
        if (value && value.trim().length > 500) {
          errors.message = 'Message must be less than 500 characters';
        }
        break;

      case 'role':
        const validRoles = availableRoles.map(r => r.id);
        if (!value || !validRoles.includes(value)) {
          errors.role = 'Please select a valid role';
        }
        break;
    }

    return errors;
  };

  const validateForm = () => {
    const errors = {};

    if (invitationMode === 'email') {
      Object.assign(errors, validateField('email', email));
      Object.assign(errors, validateField('phone', phoneNumber));
    } else if (invitationMode === 'users') {
      if (selectedUsers.length === 0) {
        errors.users = 'Please select at least one user to invite';
      }
    }

    Object.assign(errors, validateField('message', message));
    Object.assign(errors, validateField('role', selectedRole));

    setFormErrors(errors);
    setShowErrors(true);

    return Object.keys(errors).length === 0;
  };

  // User search functionality
  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.searchUsers(query);

      if (response.success && response.data) {
        // Filter out already selected users and current user
        const filteredResults = response.data.filter(searchUser =>
          searchUser.id !== user?.id &&
          !selectedUsers.some(selected => selected.id === searchUser.id)
        );
        setSearchResults(filteredResults);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('User search failed:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const addSelectedUser = (selectedUser) => {
    const newUser = {
      ...selectedUser,
      assignedRole: selectedRole // Assign the currently selected role
    };
    setSelectedUsers(prev => [...prev, newUser]);
    setUserRoles(prev => ({ ...prev, [selectedUser.id]: selectedRole }));
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeSelectedUser = (userId) => {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId));
    setUserRoles(prev => {
      const newRoles = { ...prev };
      delete newRoles[userId];
      return newRoles;
    });
  };

  const updateUserRole = (userId, newRole) => {
    setUserRoles(prev => ({ ...prev, [userId]: newRole }));
    setSelectedUsers(prev =>
      prev.map(user =>
        user.id === userId ? { ...user, assignedRole: newRole } : user
      )
    );
  };

  // Enhanced input handlers with sanitization
  const handleEmailChange = (value) => {
    const sanitized = sanitizeInput(value, 'email');
    setEmail(sanitized);

    // Clear email error when user starts typing
    if (formErrors.email) {
      setFormErrors(prev => ({ ...prev, email: undefined }));
    }
  };

  const handlePhoneChange = (value) => {
    const sanitized = sanitizeInput(value, 'phone');
    setPhoneNumber(sanitized);

    // Clear phone error when user starts typing
    if (formErrors.phone) {
      setFormErrors(prev => ({ ...prev, phone: undefined }));
    }
  };

  const handleMessageChange = (value) => {
    const sanitized = sanitizeInput(value, 'message');
    setMessage(sanitized);

    // Clear message error when user starts typing
    if (formErrors.message) {
      setFormErrors(prev => ({ ...prev, message: undefined }));
    }
  };

  const handleSendInvitation = async () => {
    if (!canInvite) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson, secretary, and treasurer can send invitations',
      });
      return;
    }

    // Comprehensive form validation
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Form Validation Failed',
        text2: 'Please fix the errors highlighted below',
        visibilityTime: 4000,
      });
      return;
    }

    try {
      setLoading(true);

      // Initialize counters for tracking invitation results
      let successCount = 0;
      let failureCount = 0;

      if (invitationMode === 'email') {
        // Send single email invitation with role information
        const roleInfo = availableRoles.find(r => r.id === selectedRole);
        const enhancedMessage = message.trim() ||
          `You have been invited to join ${chamaName} as a ${roleInfo.name}!\n\n` +
          `Role: ${roleInfo.name}\n` +
          `Responsibilities: ${roleInfo.description}\n\n` +
          `Please accept this invitation to become part of our chama.`;

        const invitationData = {
          email: sanitizeInput(email, 'email'),
          phone_number: sanitizeInput(phoneNumber, 'phone') || undefined,
          message: sanitizeInput(enhancedMessage, 'message'),
          role: selectedRole,
          role_name: roleInfo.name,
          role_description: roleInfo.description,
        };

        // Final security validation before sending
        const finalValidation = [
          invitationData.email.length > 0 && invitationData.email.length <= 254,
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(invitationData.email),
          !invitationData.phone_number || /^[\+]?[0-9\s\-()]{7,20}$/.test(invitationData.phone_number),
          invitationData.message.length <= 500,
          availableRoles.some(r => r.id === invitationData.role)
        ];

        if (!finalValidation.every(Boolean)) {
          throw new Error('Security validation failed. Please check your inputs.');
        }

        const response = await api.sendChamaInvitation(chamaId, invitationData);

        if (response.success) {
          successCount = 1; // Set success count for email invitation
          Toast.show({
            type: 'success',
            text1: 'Invitation Sent',
            text2: `${invitationData.email} invited as ${roleInfo.name}`,
            visibilityTime: 4000,
          });

          // Clear form
          setEmail('');
          setPhoneNumber('');
          setMessage('');
          setSelectedRole('member');
          setFormErrors({});
          setShowErrors(false);
        } else {
          throw new Error(response.error || 'Failed to send invitation');
        }
      } else {
        // Send multiple invitations to selected users with individual roles
        // successCount and failureCount already declared at function level
        const baseMessage = message.trim() || `You have been invited to join ${chamaName}!`;

        for (const user of selectedUsers) {
          try {
            const userRole = userRoles[user.id] || selectedRole;
            const roleInfo = availableRoles.find(r => r.id === userRole);

            const enhancedMessage = `${baseMessage}\n\n` +
              `Role: ${roleInfo.name}\n` +
              `Responsibilities: ${roleInfo.description}\n\n` +
              `Please accept this invitation to become part of our chama.`;

            const invitationData = {
              email: sanitizeInput(user.email, 'email'),
              phone_number: sanitizeInput(user.phone, 'phone') || undefined,
              message: sanitizeInput(enhancedMessage, 'message'),
              role: userRole,
              role_name: roleInfo.name,
              role_description: roleInfo.description,
            };

            // Security validation for each user
            const userValidation = [
              invitationData.email.length > 0 && invitationData.email.length <= 254,
              /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(invitationData.email),
              !invitationData.phone_number || /^[\+]?[0-9\s\-()]{7,20}$/.test(invitationData.phone_number),
              invitationData.message.length <= 500,
              availableRoles.some(r => r.id === invitationData.role)
            ];

            if (!userValidation.every(Boolean)) {
              console.error(`Security validation failed for user ${user.email}`);
              failureCount++;
              continue;
            }

            const response = await api.sendChamaInvitation(chamaId, invitationData);

            if (response.success) {
              successCount++;
            } else {
              failureCount++;
              console.error(`Failed to invite ${user.email}:`, response.error);
            }
          } catch (error) {
            failureCount++;
            console.error(`Error inviting ${user.email}:`, error);
          }
        }

        // Show results with role information
        if (successCount > 0 && failureCount === 0) {
          Toast.show({
            type: 'success',
            text1: 'All Invitations Sent',
            text2: `Successfully sent ${successCount} invitation${successCount !== 1 ? 's' : ''} with role assignments`,
            visibilityTime: 4000,
          });
        } else if (successCount > 0 && failureCount > 0) {
          Toast.show({
            type: 'info',
            text1: 'Partial Success',
            text2: `${successCount} sent, ${failureCount} failed`,
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'All Invitations Failed',
            text2: 'Failed to send any invitations',
            visibilityTime: 4000,
          });
        }

        // Clear selections and reset form
        setSelectedUsers([]);
        setUserRoles({});
        setMessage('');
        setSelectedRole('member');
        setFormErrors({});
        setShowErrors(false);
      }

      // Navigate back after a short delay if successful
      if ((invitationMode === 'email') || (invitationMode === 'users' && successCount > 0)) {
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Send',
        text2: error.message || 'Failed to send invitation',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canInvite) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <Ionicons name="lock-closed" size={64} color={colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>
            Access Denied
          </Text>
          <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
            Only chairperson, secretary, and treasurer can send member invitations.
          </Text>
          <TouchableOpacity
            style={[styles.backToMembersButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (onRouteChange) {
                onRouteChange('members', 'ChamaMembersScreen');
              } else {
                navigation.goBack();
              }
            }}
          >
            <Text style={styles.backToMembersButtonText}>Back to Members</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (onRouteChange) {
              onRouteChange('members', 'ChamaMembersScreen');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Invite Members
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Invite New Members
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Send invitations to join {chamaName}. You can invite by email or search for existing users.
            </Text>
          </View>
        </View>

        {/* Invitation Mode Selection */}
        <View style={[styles.modeCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Invitation Method
          </Text>

          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                { borderColor: colors.border },
                invitationMode === 'email' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
              ]}
              onPress={() => setInvitationMode('email')}
            >
              <Ionicons
                name="mail"
                size={20}
                color={invitationMode === 'email' ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.modeButtonText,
                { color: invitationMode === 'email' ? colors.primary : colors.textSecondary }
              ]}>
                By Email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                { borderColor: colors.border },
                invitationMode === 'users' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
              ]}
              onPress={() => setInvitationMode('users')}
            >
              <Ionicons
                name="people"
                size={20}
                color={invitationMode === 'users' ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.modeButtonText,
                { color: invitationMode === 'users' ? colors.primary : colors.textSecondary }
              ]}>
                Search Users
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Role Selection */}
        <View style={[styles.roleCard, { backgroundColor: colors.surface }]}>
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
                  setSelectedRole(role.id);
                  if (formErrors.role) {
                    setFormErrors(prev => ({ ...prev, role: undefined }));
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
                    color={colors.white}
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

        {/* Email Invitation Form */}
        {invitationMode === 'email' && (
          <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Email Invitation
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Email Address *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: showErrors && formErrors.email ? colors.error : colors.border,
                    color: colors.text
                  }
                ]}
                value={email}
                onChangeText={handleEmailChange}
                placeholder="Enter email address"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {showErrors && formErrors.email && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {formErrors.email}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Phone Number (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: showErrors && formErrors.phone ? colors.error : colors.border,
                    color: colors.text
                  }
                ]}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="Enter phone number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
              {showErrors && formErrors.phone && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {formErrors.phone}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* User Search Form */}
        {invitationMode === 'users' && (
          <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Search & Select Users
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Search Users
              </Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    searchUsers(text);
                  }}
                  placeholder="Search by name, email, or phone..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
                {searchLoading && (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.searchLoader} />
                )}
              </View>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                <Text style={[styles.searchResultsTitle, { color: colors.text }]}>
                  Search Results
                </Text>
                {searchResults.slice(0, 5).map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[styles.userSearchItem, { borderBottomColor: colors.border }]}
                    onPress={() => addSelectedUser(user)}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.userAvatarText}>
                        {user.firstName?.[0]?.toUpperCase()}{user.lastName?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.text }]}>
                        {user.firstName} {user.lastName}
                      </Text>
                      <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                        {user.email}
                      </Text>
                      {user.phone && (
                        <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
                          {user.phone}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="add-circle" size={24} color={colors.primary} />
                  </TouchableOpacity>
                ))}
                {searchResults.length > 5 && (
                  <Text style={[styles.moreResultsText, { color: colors.textSecondary }]}>
                    +{searchResults.length - 5} more results. Refine your search.
                  </Text>
                )}
              </View>
            )}

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <View style={styles.selectedUsers}>
                <Text style={[styles.selectedUsersTitle, { color: colors.text }]}>
                  Selected Users ({selectedUsers.length})
                </Text>
                {selectedUsers.map((user) => {
                  const userRole = userRoles[user.id] || selectedRole;
                  const roleInfo = availableRoles.find(r => r.id === userRole);

                  return (
                    <View
                      key={user.id}
                      style={[styles.selectedUserItem, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
                    >
                      <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.userAvatarText}>
                          {user.firstName?.[0]?.toUpperCase()}{user.lastName?.[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.text }]}>
                          {user.firstName} {user.lastName}
                        </Text>
                        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                          {user.email}
                        </Text>
                        <View style={styles.userRoleContainer}>
                          <Ionicons name={roleInfo.icon} size={14} color={colors.primary} />
                          <Text style={[styles.userRoleText, { color: colors.primary }]}>
                            {roleInfo.name}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.userActions}>
                        <TouchableOpacity
                          style={[styles.roleChangeButton, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}
                          onPress={() => {
                            // Cycle through available roles
                            const currentIndex = availableRoles.findIndex(r => r.id === userRole);
                            const nextIndex = (currentIndex + 1) % availableRoles.length;
                            updateUserRole(user.id, availableRoles[nextIndex].id);
                          }}
                        >
                          <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => removeSelectedUser(user.id)}
                          style={styles.removeButton}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Message Section (Common for both modes) */}
        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Personal Message
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Custom Message (Optional)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.background,
                  borderColor: showErrors && formErrors.message ? colors.error : colors.border,
                  color: colors.text
                }
              ]}
              value={message}
              onChangeText={handleMessageChange}
              placeholder={`You have been invited to join ${chamaName} as a ${availableRoles.find(r => r.id === selectedRole)?.name}!`}
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {showErrors && formErrors.message && (
              <Text style={[styles.errorText, { color: colors.error }]}>
                {formErrors.message}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSendInvitation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
            <Text style={styles.sendButtonText}>
              {loading ? 'Sending...' :
                invitationMode === 'users' && selectedUsers.length > 1
                  ? `Send ${selectedUsers.length} Invitations`
                  : 'Send Invitation'
              }
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  accessDeniedText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  backToMembersButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backToMembersButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modeCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchContainer: {
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    paddingRight: 40,
  },
  searchLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  searchResults: {
    marginTop: 16,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  userSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
  },
  moreResultsText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  selectedUsers: {
    marginTop: 20,
  },
  selectedUsersTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  removeButton: {
    padding: 4,
  },
  // Role selection styles
  roleCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  roleHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  roleSubtitle: {
    fontSize: 14,
    marginTop: 4,
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
  // User role display styles
  userRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleChangeButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  // Error text style
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
  },
});

export default InviteMembers;
