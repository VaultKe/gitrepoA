/**
 * Date utility functions for VaultKe mobile app
 * All dates are handled in East African Time (EAT) - UTC+3
 */

// East African Time offset (UTC+3)
const EAT_OFFSET = 3 * 60; // 3 hours in minutes

/**
 * Get current date/time in East African Time
 * @returns {Date} Current date in EAT
 */
export const nowEAT = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (EAT_OFFSET * 60000));
};

/**
 * Convert any date to East African Time
 * @param {Date|string} date - Date to convert
 * @returns {Date} Date in EAT
 */
export const toEAT = (date) => {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  // If the date string already has EAT timezone (+03:00), just return the parsed date
  if (typeof date === 'string' && date.includes('+03:00')) {
    return d;
  }

  // If it's already a Date object or doesn't need conversion, return as is
  // The Date object will be formatted with the correct timezone in formatDate
  return d;
};

/**
 * Format date for display in various formats
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'default') => {
  if (!date) return 'Invalid Date';

  const eatDate = toEAT(date);
  if (!eatDate || isNaN(eatDate.getTime())) return 'Invalid Date';

  // Always use Africa/Nairobi timezone for consistent EAT display
  const options = { timeZone: 'Africa/Nairobi' };

  switch (format) {
    case 'short':
      return eatDate.toLocaleDateString('en-KE', {
        ...options,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

    case 'long':
      return eatDate.toLocaleDateString('en-KE', {
        ...options,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    case 'datetime':
      return eatDate.toLocaleString('en-KE', {
        ...options,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

    case 'time':
      return eatDate.toLocaleTimeString('en-KE', {
        ...options,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

    case 'relative':
      return getTimeAgo(eatDate);

    case 'order':
      // Special format for order tracking
      return eatDate.toLocaleString('en-KE', {
        ...options,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

    default:
      return eatDate.toLocaleDateString('en-KE', {
        ...options,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
  }
};

/**
 * Get relative time (e.g., "2 hours ago", "3 days ago")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export const getTimeAgo = (date) => {
  if (!date) return 'Unknown';
  
  const eatDate = toEAT(date);
  if (!eatDate || isNaN(eatDate.getTime())) return 'Invalid Date';
  
  const now = nowEAT();
  const diffInSeconds = Math.floor((now - eatDate) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
};

/**
 * Check if a date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is today
 */
export const isToday = (date) => {
  if (!date) return false;
  
  const eatDate = toEAT(date);
  const today = nowEAT();
  
  return eatDate.toDateString() === today.toDateString();
};

/**
 * Check if a date is yesterday
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is yesterday
 */
export const isYesterday = (date) => {
  if (!date) return false;
  
  const eatDate = toEAT(date);
  const yesterday = new Date(nowEAT());
  yesterday.setDate(yesterday.getDate() - 1);
  
  return eatDate.toDateString() === yesterday.toDateString();
};

/**
 * Format date for order tracking timeline
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date for order tracking
 */
export const formatOrderDate = (date) => {
  if (!date) return 'Invalid Date';
  
  const eatDate = toEAT(date);
  if (!eatDate || isNaN(eatDate.getTime())) return 'Invalid Date';
  
  if (isToday(eatDate)) {
    return `Today, ${formatDate(eatDate, 'time')}`;
  }
  
  if (isYesterday(eatDate)) {
    return `Yesterday, ${formatDate(eatDate, 'time')}`;
  }
  
  return formatDate(eatDate, 'datetime');
};

/**
 * Parse date string safely
 * @param {string} dateString - Date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export const parseDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return toEAT(date);
  } catch (error) {
    console.warn('Failed to parse date:', dateString, error);
    return null;
  }
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: KES)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'KES') => {
  if (typeof amount !== 'number' || isNaN(amount)) return 'KSh 0';
  
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Get timezone info for East Africa
 * @returns {object} Timezone information
 */
export const formatTime = (date) => {
  return formatDate(date, 'time');
};

/**
 * Get timezone info for East Africa
 * @returns {object} Timezone information
 */
export const getTimezoneInfo = () => {
  return {
    name: 'East Africa Time',
    abbreviation: 'EAT',
    offset: '+03:00',
    offsetMinutes: EAT_OFFSET,
  };
};

export default {
  nowEAT,
  toEAT,
  formatDate,
  formatTime,
  getTimeAgo,
  isToday,
  isYesterday,
  formatOrderDate,
  parseDate,
  formatCurrency,
  getTimezoneInfo,
};
