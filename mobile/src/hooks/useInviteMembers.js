import { useState, useEffect, useCallback } from 'react';
import { Toast } from 'react-native';
import { useApp } from '../context/AppContext';
import { getThemeColors } from '../utils/theme';
import api from '../services/api';

const useInviteMembers = ({ route, navigation, onRouteChange }) => {
  const { chamaId, chamaName, userRole } = route.params;
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [invitationMode, setInvitationMode] = useState('email');

  const [selectedRole, setSelectedRole] = useState('member');
  const [userRoles, setUserRoles] = useState({});

  const [formErrors, setFormErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  const canInvite = ['chairperson', 'secretary', 'treasurer'].includes(userRole);

  const roleOptions = [
    { id: 'member', name: 'Member', description: 'Regular member with basic privileges', icon: 'person', canBeAssignedBy: ['chairperson', 'secretary', 'treasurer'] },
    { id: 'treasurer', name: 'Treasurer', description: 'Manages finances and transactions', icon: 'wallet', canBeAssignedBy: ['chairperson'] },
    { id: 'secretary', name: 'Secretary', description: 'Keeps records and manages communications', icon: 'document-text', canBeAssignedBy: ['chairperson'] },
  ];

  const availableRoles = roleOptions.filter(role => role.canBeAssignedBy.includes(userRole));

  const sanitizeInput = useCallback((value, type = 'text') => {
    if (!value) return '';

    switch (type) {
      case 'email':
        return value.toString().toLowerCase().replace(/[<>\"'&]/g, '').trim().substring(0, 254);
      case 'phone':
        return value.toString().replace(/[^0-9\s\-+()]/g, '').trim().substring(0, 20);
      case 'message':
        return value.toString().replace(/[<>\"'&]/g, '').trim().substring(0, 500);
      case 'name':
        return value.toString().replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim().substring(0, 100);
      default:
        return value.toString().replace(/[<>\"'&]/g, '').trim().substring(0, 255);
    }
  }, []);

  const validateField = useCallback((field, value) => {
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
  }, [availableRoles]);

  const validateForm = useCallback(() => {
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
  }, [invitationMode, email, phoneNumber, selectedUsers, message, selectedRole, validateField]);

  const searchUsers = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.searchUsers(query);

      if (response.success && response.data) {
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
  }, [user?.id, selectedUsers]);

  const addSelectedUser = useCallback((selectedUser) => {
    const newUser = {
      ...selectedUser,
      assignedRole: selectedRole
    };
    setSelectedUsers(prev => [...prev, newUser]);
    setUserRoles(prev => ({ ...prev, [selectedUser.id]: selectedRole }));
    setSearchQuery('');
    setSearchResults([]);
  }, [selectedRole]);

  const removeSelectedUser = useCallback((userId) => {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId));
    setUserRoles(prev => {
      const newRoles = { ...prev };
      delete newRoles[userId];
      return newRoles;
    });
  }, []);

  const updateUserRole = useCallback((userId, newRole) => {
    setUserRoles(prev => ({ ...prev, [userId]: newRole }));
    setSelectedUsers(prev =>
      prev.map(user =>
        user.id === userId ? { ...user, assignedRole: newRole } : user
      )
    );
  }, []);

  const handleSendInvitation = useCallback(async () => {
    if (!canInvite) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson, secretary, and treasurer can send invitations',
      });
      return;
    }

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
      let successCount = 0;
      let failureCount = 0;

      if (invitationMode === 'email') {
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
          successCount = 1;
          Toast.show({
            type: 'success',
            text1: 'Invitation Sent',
            text2: `${invitationData.email} invited as ${roleInfo.name}`,
            visibilityTime: 4000,
          });

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

        setSelectedUsers([]);
        setUserRoles({});
        setMessage('');
        setSelectedRole('member');
        setFormErrors({});
        setShowErrors(false);
      }

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
  }, [canInvite, validateForm, invitationMode, email, phoneNumber, selectedUsers, message, selectedRole, availableRoles, chamaId, chamaName, userRoles, sanitizeInput, navigation]);

  return {
    email, setEmail,
    phoneNumber, setPhoneNumber,
    message, setMessage,
    loading, setLoading,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    searchLoading, setSearchLoading,
    selectedUsers, setSelectedUsers,
    showUserSearch, setShowUserSearch,
    invitationMode, setInvitationMode,
    selectedRole, setSelectedRole,
    userRoles, setUserRoles,
    formErrors, setFormErrors,
    showErrors, setShowErrors,
    canInvite,
    roleOptions,
    availableRoles,
    sanitizeInput,
    validateField,
    validateForm,
    searchUsers,
    addSelectedUser,
    removeSelectedUser,
    updateUserRole,
    handleSendInvitation,
    colors,
    chamaId,
    chamaName,
    userRole,
    navigation,
    onRouteChange,
  };
};

export default useInviteMembers;
