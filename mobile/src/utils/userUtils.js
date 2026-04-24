/**
 * Utility functions for user data handling
 */

/**
 * Get user's display name from user object
 * Handles different naming conventions (camelCase, snake_case, etc.)
 * @param {Object} user - User object
 * @returns {string} - User's display name
 */
export const getUserDisplayName = (user) => {
  if (!user) return 'User';
  
  // Try different name field combinations
  const firstName = user.firstName || user.first_name || user.fname;
  const lastName = user.lastName || user.last_name || user.lname;
  
  // If we have both first and last name
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  
  // If we have only first name
  if (firstName) {
    return firstName;
  }
  
  // If we have a full name field
  if (user.fullName || user.full_name || user.name) {
    return user.fullName || user.full_name || user.name;
  }
  
  // If we have display name
  if (user.displayName || user.display_name) {
    return user.displayName || user.display_name;
  }
  
  // If we have username
  if (user.username || user.userName) {
    return user.username || user.userName;
  }
  
  // If we have email, use the part before @
  if (user.email) {
    return user.email.split('@')[0];
  }
  
  // Fallback
  return 'User';
};

/**
 * Get user's first name only
 * @param {Object} user - User object
 * @returns {string} - User's first name
 */
export const getUserFirstName = (user) => {
  if (!user) return 'User';
  
  const firstName = user.firstName || user.first_name || user.fname;
  if (firstName) return firstName;
  
  // Try to extract first name from full name
  const fullName = user.fullName || user.full_name || user.name;
  if (fullName) {
    return fullName.split(' ')[0];
  }
  
  // If we have display name, try to extract first part
  const displayName = user.displayName || user.display_name;
  if (displayName) {
    return displayName.split(' ')[0];
  }
  
  // If we have username
  if (user.username || user.userName) {
    return user.username || user.userName;
  }
  
  // If we have email, use the part before @
  if (user.email) {
    return user.email.split('@')[0];
  }
  
  return 'User';
};

/**
 * Get user's initials for avatar display
 * @param {Object} user - User object
 * @returns {string} - User's initials (max 2 characters)
 */
export const getUserInitials = (user) => {
  if (!user) return 'U';
  
  const firstName = user.firstName || user.first_name || user.fname;
  const lastName = user.lastName || user.last_name || user.lname;
  
  // If we have both first and last name
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  
  // If we have only first name
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  
  // Try full name
  const fullName = user.fullName || user.full_name || user.name;
  if (fullName) {
    const nameParts = fullName.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  }
  
  // Try display name
  const displayName = user.displayName || user.display_name;
  if (displayName) {
    const nameParts = displayName.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }
  
  // Try username
  if (user.username || user.userName) {
    const username = user.username || user.userName;
    return username.substring(0, 2).toUpperCase();
  }
  
  // Try email
  if (user.email) {
    const emailName = user.email.split('@')[0];
    return emailName.substring(0, 2).toUpperCase();
  }
  
  return 'U';
};

/**
 * Get user's email with fallback
 * @param {Object} user - User object
 * @returns {string} - User's email
 */
export const getUserEmail = (user) => {
  if (!user) return '';
  return user.email || user.emailAddress || user.email_address || '';
};

/**
 * Get user's phone with fallback
 * @param {Object} user - User object
 * @returns {string} - User's phone number
 */
export const getUserPhone = (user) => {
  if (!user) return '';
  return user.phone || user.phoneNumber || user.phone_number || user.mobile || '';
};

/**
 * Check if user has complete profile information
 * @param {Object} user - User object
 * @returns {boolean} - Whether user profile is complete
 */
export const isUserProfileComplete = (user) => {
  if (!user) return false;
  
  const hasName = getUserFirstName(user) !== 'User';
  const hasEmail = getUserEmail(user) !== '';
  const hasPhone = getUserPhone(user) !== '';
  
  return hasName && hasEmail && hasPhone;
};

/**
 * Format user's location
 * @param {Object} user - User object
 * @returns {string} - Formatted location string
 */
export const getUserLocation = (user) => {
  if (!user) return '';
  
  const town = user.town || user.city;
  const county = user.county || user.state || user.region;
  const country = user.country;
  
  const locationParts = [town, county, country].filter(Boolean);
  return locationParts.join(', ');
};
