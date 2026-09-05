import { useState, useEffect, useCallback } from 'react';
import Toast from 'react-native-toast-message';
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
  const [searchError, setSearchError] = useState('');
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
    console.log('[DEBUG] searchUsers called with query:', query);

    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError('');
      const trimmed = query.trim();
      const digits = trimmed.replace(/\D/g, '');

      console.log('[DEBUG] searchUsers trimmed:', trimmed, 'digits:', digits);

      if (digits.length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      console.log('[DEBUG] Calling searchUsers API with digits:', digits);
      const partialResponse = await api.searchUsers(digits);
      console.log('[DEBUG] Partial search response:', partialResponse);

      const exactResponse = digits.length >= 9
        ? await api.searchUserByPhone(trimmed).then(r => {
            console.log('[DEBUG] Exact phone search response:', r);
            return r;
          }).catch(err => {
            console.log('[DEBUG] Exact phone search error:', err);
            return { success: false, data: null };
          })
        : { success: false, data: null };

      const results = [];
      const seen = new Set();

      const addUser = (user) => {
        if (!user || !user.id || seen.has(user.id)) return;
        seen.add(user.id);
        results.push({
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phone: user.phone || user.phoneNumber || '',
        });
      };

      if (partialResponse.success && Array.isArray(partialResponse.data)) {
        console.log('[DEBUG] Adding partial search users:', partialResponse.data.length);
        partialResponse.data.forEach(addUser);
      } else {
        console.log('[DEBUG] Partial search failed or no data:', partialResponse);
      }

      if (exactResponse.success && exactResponse.data && exactResponse.data.id) {
        console.log('[DEBUG] Adding exact phone search user:', exactResponse.data);
        addUser(exactResponse.data);
      } else {
        console.log('[DEBUG] Exact phone search no match or failed:', exactResponse);
      }

      const filteredResults = results.filter(searchUser =>
        searchUser.id !== user?.id &&
        !selectedUsers.some(selected => selected.id === searchUser.id)
      );

      console.log('[DEBUG] Final filtered results:', filteredResults);

      if (filteredResults.length === 0) {
        setSearchError('No user found with this phone number');
      }

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('[DEBUG] User search failed:', error);
      setSearchError(error.message || 'Search failed. Please try again.');
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
    setSearchError('');
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
    console.log('[DEBUG] handleSendInvitation called', {
      canInvite,
      invitationMode,
      selectedUsersCount: selectedUsers.length,
      selectedUsers: selectedUsers.map(u => ({ id: u.id, email: u.email, phone: u.phone })),
      emailModeEmail: email,
      emailModePhone: phoneNumber,
      selectedRole,
      chamaId,
    });

    if (!canInvite) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson, secretary, and treasurer can send invitations',
      });
      return;
    }

    if (!validateForm()) {
      const errors = {};
      Object.assign(errors, validateField('email', email));
      Object.assign(errors, validateField('phone', phoneNumber));
      Object.assign(errors, validateField('message', message));
      Object.assign(errors, validateField('role', selectedRole));
      console.log('[DEBUG] Form validation failed', errors);
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

        console.log('[DEBUG] Sending email invitation', invitationData);

        const finalValidation = [
          invitationData.email.length > 0 && invitationData.email.length <= 254,
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(invitationData.email),
          !invitationData.phone_number || /^[\+]?[0-9\s\-()]{7,20}$/.test(invitationData.phone_number),
          invitationData.message.length <= 500,
          availableRoles.some(r => r.id === invitationData.role)
        ];

        console.log('[DEBUG] Email invitation validation', finalValidation);

        if (!finalValidation.every(Boolean)) {
          throw new Error('Security validation failed. Please check your inputs.');
        }

        const response = await api.sendChamaInvitation(chamaId, invitationData);
        console.log('[DEBUG] Email invitation response', response);

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

        console.log('[DEBUG] Sending user invitations', {
          selectedUsers: selectedUsers.map(u => ({ id: u.id, email: u.email, phone: u.phone, role: u.assignedRole })),
          userRoles,
          selectedRole,
        });

        // Collected so the toast below can say *why* an invite failed
        // ("already invited", "already a member") instead of just a bare
        // count -- a failure with no reason shown is indistinguishable from
        // the app being broken.
        const failureReasons = [];

        for (const user of selectedUsers) {
          const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'this person';
          try {
            const userRole = userRoles[user.id] || selectedRole;
            const roleInfo = availableRoles.find(r => r.id === userRole);

            const enhancedMessage = `${baseMessage}\n\n` +
              `Role: ${roleInfo.name}\n` +
              `Responsibilities: ${roleInfo.description}\n\n` +
              `Please accept this invitation to become part of our chama.`;

            // `user.email`/`user.phone` here come straight from the search
            // results, and the search API deliberately returns *masked*
            // values for both (e.g. "e**@gmail.com", "+254*******14") --
            // privacy: a search should never hand back another user's real
            // contact details. They were never submittable data. Sanitizing
            // the masked email did nothing to fix it (an email regex rejects
            // "*" outright), and sanitizing the masked phone mangled it into
            // a garbled, truncated number -- either way, every invitation
            // sent this way failed the same "Security validation failed"
            // check regardless of who was selected. We already know exactly
            // which account this is, though, so send its id instead and let
            // the server resolve the real email itself.
            const invitationData = {
              user_id: user.id,
              message: sanitizeInput(enhancedMessage, 'message'),
              role: userRole,
              role_name: roleInfo.name,
              role_description: roleInfo.description,
            };

            console.log('[DEBUG] Sending user invitation payload', { userId: user.id, invitationData });

            const userValidation = [
              !!invitationData.user_id,
              invitationData.message.length <= 500,
              availableRoles.some(r => r.id === invitationData.role)
            ];

            console.log('[DEBUG] User invitation validation', { userId: user.id, userValidation });

            if (!userValidation.every(Boolean)) {
              console.error(`Security validation failed for user ${user.email}`, { user, invitationData });
              failureCount++;
              failureReasons.push(`${userName}: invalid invitation data`);
              continue;
            }

            const response = await api.sendChamaInvitation(chamaId, invitationData);
            console.log('[DEBUG] User invitation response', { userId: user.id, response });

            if (response.success) {
              successCount++;
            } else {
              failureCount++;
              failureReasons.push(`${userName}: ${response.error || 'unknown error'}`);
              console.error(`Failed to invite ${user.email}:`, response.error);
            }
          } catch (error) {
            failureCount++;
            failureReasons.push(`${userName}: ${error.message || 'unknown error'}`);
            console.error(`Error inviting ${user.email}:`, error);
          }
        }

        console.log('[DEBUG] User invitation summary', { successCount, failureCount, failureReasons });

        // Reporting *why* an invite failed, not just how many did, is what
        // tells someone "you already invited this person" apart from "the
        // app is broken" -- a bare count can't do that.
        const reasonsText = failureReasons.length > 0
          ? failureReasons.length === 1
            ? failureReasons[0]
            : `${failureReasons[0]} (+${failureReasons.length - 1} more)`
          : '';

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
            text2: `${successCount} sent, ${failureCount} failed${reasonsText ? ` -- ${reasonsText}` : ''}`,
            visibilityTime: 5000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'All Invitations Failed',
            text2: reasonsText || 'Failed to send any invitations',
            visibilityTime: 5000,
          });
        }

        console.log('[DEBUG] Invitation result', { successCount, failureCount, willNavigate: (invitationMode === 'email') || (invitationMode === 'users' && successCount > 0) });

        setSelectedUsers([]);
        setUserRoles({});
        setMessage('');
        setSelectedRole('member');
        setFormErrors({});
        setShowErrors(false);
      }

      if ((invitationMode === 'email') || (invitationMode === 'users' && successCount > 0)) {
        console.log('[DEBUG] Navigating back after successful invitation');
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        console.log('[DEBUG] Staying on page because no successful invitations');
      }
    } catch (error) {
      console.error('[DEBUG] Error sending invitation:', error);
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
    searchError, setSearchError,
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
