export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Nairobi'
  });
};

export const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2
  }).format(Math.abs(numAmount));
};

export const getTransactionTypeLabel = (type) => {
  switch (type) {
    case 'deposit': return 'Deposit';
    case 'withdraw': return 'Withdrawal';
    case 'transfer': return 'Transfer';
    case 'payment': return 'Payment';
    default: return 'Transaction';
  }
};