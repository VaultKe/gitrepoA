const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown Date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

const isMemberLeft = (participant) => {
  if (!participant) return false;
  const isActive = participant?.is_active;
  return isActive === false || isActive === 0 || isActive === '0' || isActive === 'false';
};

const getMemberName = (item) => {
  const userObj = item?.user || item || {};
  const firstName = userObj?.first_name || userObj?.firstName || item?.first_name || item?.firstName || '';
  const lastName = userObj?.last_name || userObj?.lastName || item?.last_name || item?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (!fullName) return userObj?.email || item?.email || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
  return fullName;
};

const getMemberShortName = (item) => {
  const userObj = item?.user || item || {};
  const firstName = userObj?.first_name || userObj?.firstName || item?.first_name || item?.firstName || '';
  const lastName = userObj?.last_name || userObj?.lastName || item?.last_name || item?.lastName || '';
  if (firstName && lastName) return `${firstName} ${lastName.charAt(0)}.`;
  return firstName || lastName || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
};

export {
  formatCurrency,
  formatDate,
  isMemberLeft,
  getMemberName,
  getMemberShortName,
};
