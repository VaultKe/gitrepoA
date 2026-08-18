export const maskPhone = (phone) => {
  if (!phone) return 'N/A';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    return phone.slice(0, 2) + '****' + phone.slice(-4);
  }
  return phone;
};

export const maskLocation = (location) => {
  if (!location) return 'N/A';
  const parts = location.split(',');
  if (parts.length >= 2) {
    const town = parts[0].trim();
    const county = parts.slice(1).join(',').trim();
    const maskedTown = town.slice(0, 2) + '****';
    return `${maskedTown}, ${county}`;
  }
  return location.slice(0, 2) + '****';
};

export const maskOccupation = (text) => {
  if (!text) return 'N/A';
  const words = text.split(' ');
  return words.map((word, i) => {
    if (i === 0) return word;
    if (word.length <= 2) return word;
    return word.slice(0, 2) + '****';
  }).join(' ');
};

export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
};

export const formatCurrency = (amount) => {
  if (!amount) return 'KES 0';
  return `KES ${Number(amount).toLocaleString()}`;
};

export const getFeeStatusColor = (status, colors) => {
  switch (status) {
    case 'paid': return colors.success;
    case 'overdue': return colors.error;
    default: return colors.warning;
  }
};

export const getFeeStatusIcon = (status) => {
  switch (status) {
    case 'paid': return 'checkmark-circle';
    case 'overdue': return 'alert-circle';
    default: return 'time';
  }
};

export const getRoleColor = (role, colors) => {
  switch (role) {
    case 'chairperson':
    case 'secretary':
    case 'treasurer':
      return colors.warning;
    default:
      return colors.textSecondary;
  }
};

export const getRoleIcon = (role) => {
  switch (role) {
    case 'chairperson':
      return 'star';
    case 'secretary':
      return 'document-text';
    case 'treasurer':
      return 'wallet';
    default:
      return 'person';
  }
};
