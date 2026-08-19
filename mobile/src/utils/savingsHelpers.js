const formatCurrency = (amount) => {
  const val = amount || 0;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(val);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
};

const getStatusColor = (status, colors) => {
  switch ((status || '').toLowerCase()) {
    case 'eligible':
      return colors.success;
    case 'active':
      return colors.primary;
    case 'pending':
      return colors.warning;
    case 'locked':
      return colors.error;
    default:
      return colors.textSecondary;
  }
};

export {
  formatCurrency,
  formatDate,
  getStatusColor,
};
