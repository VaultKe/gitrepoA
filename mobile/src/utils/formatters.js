/**
 * Utility functions for formatting data
 */

/**
 * Format currency values
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency code (default: 'KES')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'KES') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency} 0.00`;
  }

  const numAmount = Number(amount);
  
  // Format with commas and 2 decimal places
  const formatted = numAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currency} ${formatted}`;
};

/**
 * Format date values
 * @param {string|Date} date - The date to format
 * @param {string} format - The format type ('date', 'time', 'datetime', 'relative')
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'date') => {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  switch (format) {
    case 'time':
      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

    case 'datetime':
      return dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    case 'relative':
      if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffHours === 0) {
          if (diffMinutes === 0) {
            return 'Just now';
          }
          return `${diffMinutes}m ago`;
        }
        return `${diffHours}h ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }

    case 'date':
    default:
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
  }
};

/**
 * Format time remaining in seconds to human readable format
 * @param {number} seconds - Time remaining in seconds
 * @returns {string} Formatted time remaining string
 */
export const formatTimeRemaining = (seconds) => {
  if (!seconds || seconds <= 0) {
    return 'Expired';
  }

  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format percentage values
 * @param {number} value - The value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  const numValue = Number(value);
  return `${numValue.toFixed(decimals)}%`;
};

/**
 * Format large numbers with K, M, B suffixes
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted number string
 */
export const formatLargeNumber = (num, decimals = 1) => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }

  const numValue = Number(num);
  
  if (numValue >= 1000000000) {
    return `${(numValue / 1000000000).toFixed(decimals)}B`;
  } else if (numValue >= 1000000) {
    return `${(numValue / 1000000).toFixed(decimals)}M`;
  } else if (numValue >= 1000) {
    return `${(numValue / 1000).toFixed(decimals)}K`;
  } else {
    return numValue.toString();
  }
};

/**
 * Format phone numbers
 * @param {string} phone - The phone number to format
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format Kenyan phone numbers
  if (cleaned.startsWith('254')) {
    // +254 format
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  } else if (cleaned.startsWith('0')) {
    // 0xxx format
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  } else if (cleaned.length === 9) {
    // 7xx format (add 0 prefix)
    return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }

  return phone; // Return original if no pattern matches
};

/**
 * Format file sizes
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Truncate text with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) {
    return text || '';
  }

  return `${text.substring(0, maxLength)}...`;
};

/**
 * Mask sensitive data (PII) in payloads for security.
 * Masks email addresses and phone numbers recursively in objects/arrays.
 */
export const maskSensitiveData = (data) => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return maskString(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  if (typeof data === 'object') {
    const masked = {};
    const sensitiveKeys = new Set([
      'email', 'emailAddress', 'mail',
      'phone', 'phoneNumber', 'phone_number', 'phoneNumber', 'mobile', 'mobileNumber',
      'fax', 'faxNumber',
    ]);

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.has(lowerKey)) {
        masked[key] = maskString(String(data[key]));
      } else {
        masked[key] = maskSensitiveData(data[key]);
      }
    }

    return masked;
  }

  return data;
};

// Matches a UUID (standalone or embedded) such as
// 86e147f4-ed69-4988-913a-d649f4bdf105. The phone-number regex below would
// otherwise match the digit groups inside a UUID and corrupt it (e.g. turning
// "86e147f4-ed69-4988-913a-d649f4bdf105" into "86e147f4-ed*****8913a-..."),
// which then breaks any subsequent API request that uses the ID as a path param.
const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

// Matches prefixed API resource identifiers like mgr541202..., chm_abc123...
// The phone-number regex below would otherwise mangle the digit suffix of such
// IDs, breaking subsequent API requests that use them as path params.
const PREFIXED_API_ID_REGEX = /^[a-z]{2,}[a-z0-9_-]*\d[a-z0-9_-]*$/i;

const maskString = (value) => {
  if (typeof value !== 'string') return value;
  // Never mask UUIDs / API identifiers. Corrupting them destroys the
  // identifiers the app uses to build request URLs.
  if (UUID_REGEX.test(value)) return value;
  if (PREFIXED_API_ID_REGEX.test(value)) return value;

  let masked = value;

  // Mask email addresses
  masked = masked.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, localPart, domain) => {
      const maskedLocal = localPart.length <= 2
        ? '*'.repeat(localPart.length)
        : localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
      return `${maskedLocal}@${domain}`;
    }
  );

  // Mask Kenyan and international phone numbers
  // Matches formats like: +254712345678, 0712345678, 0111234567, 254712345678
  masked = masked.replace(
    /(\+?\d{1,3})?[\s-]?(0?\d{2,4})[\s-]?(\d{3,4})[\s-]?(\d{3,4})/g,
    (match, countryCode, prefix, mid, end) => {
      const digits = (countryCode || '') + prefix + mid + end;
      const visibleDigits = digits.slice(-4);
      const maskedDigits = '*'.repeat(Math.max(0, digits.length - 4));
      return `${maskedDigits}${visibleDigits}`;
    }
  );

  return masked;
};

/**
 * Format contribution status
 * @param {string} status - The contribution status
 * @returns {object} Object with formatted status and color
 */
export const formatContributionStatus = (status) => {
  const statusMap = {
    pending: { text: 'Pending', color: '#F59E0B' },
    completed: { text: 'Completed', color: '#10B981' },
    failed: { text: 'Failed', color: '#EF4444' },
    cancelled: { text: 'Cancelled', color: '#6B7280' },
    overdue: { text: 'Overdue', color: '#DC2626' },
  };

  return statusMap[status] || { text: status, color: '#6B7280' };
};

/**
 * Format loan status
 * @param {string} status - The loan status
 * @returns {object} Object with formatted status and color
 */
export const formatLoanStatus = (status) => {
  const statusMap = {
    pending: { text: 'Pending', color: '#F59E0B' },
    approved: { text: 'Approved', color: '#10B981' },
    rejected: { text: 'Rejected', color: '#EF4444' },
    disbursed: { text: 'Disbursed', color: '#3B82F6' },
    repaid: { text: 'Repaid', color: '#10B981' },
    defaulted: { text: 'Defaulted', color: '#DC2626' },
  };

  return statusMap[status] || { text: status, color: '#6B7280' };
};

/**
 * Format meeting status
 * @param {string} status - The meeting status
 * @returns {object} Object with formatted status and color
 */
export const formatMeetingStatus = (status) => {
  const statusMap = {
    scheduled: { text: 'Scheduled', color: '#3B82F6' },
    ongoing: { text: 'Ongoing', color: '#10B981' },
    completed: { text: 'Completed', color: '#6B7280' },
    cancelled: { text: 'Cancelled', color: '#EF4444' },
    postponed: { text: 'Postponed', color: '#F59E0B' },
  };

  return statusMap[status] || { text: status, color: '#6B7280' };
};
