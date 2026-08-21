export const resolveAvatarUrl = (url, uploadBaseUrl = '') => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) {
    const base = uploadBaseUrl || '';
    return `${base}${url}`;
  }
  const base = uploadBaseUrl || '';
  return `${base}/${url}`;
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const getActivityColor = (type, paymentMethod, colors) => {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'contribution':
    case 'deposit':
      return colors.success;
    case 'withdrawal':
    case 'loan':
      return colors.error;
    case 'transfer':
      return colors.primary;
    case 'fee':
      return colors.warning;
    case 'loan_repayment':
      return colors.info || colors.primary;
    case 'purchase':
    case 'refund':
      return colors.textTertiary || colors.textSecondary;
    default: {
      const pm = (paymentMethod || '').toLowerCase();
      if (pm === 'wallet' || pm === 'cash') return colors.primary;
      if (pm === 'mpesa') return colors.success;
      return colors.text;
    }
  }
};

export const getActivityIcon = (type) => {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'contribution':
      return 'people';
    case 'deposit':
      return 'arrow-down-circle';
    case 'withdrawal':
      return 'arrow-up-circle';
    case 'transfer':
      return 'swap-horizontal';
    case 'loan':
      return 'card';
    case 'loan_repayment':
      return 'card';
    case 'fee':
      return 'receipt';
    case 'purchase':
      return 'cart';
    case 'refund':
      return 'refresh';
    default:
      return 'ellipsis-horizontal-circle';
  }
};

export const getActivityDescription = (tx) => {
  const desc = tx.description || '';
  const type = tx.type || 'transaction';
  const paymentMethod = tx.paymentMethod || '';

  if (desc.trim()) {
    if (desc.includes('Auto-generated')) return `${type.charAt(0).toUpperCase() + type.slice(1)}`;
    return desc;
  }

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  const methodLabel = paymentMethod ? ` via ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}` : '';
  return `${typeLabel}${methodLabel}`;
};

export const formatActivityDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getTotalBalance = (wallets) => {
  return wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
};
