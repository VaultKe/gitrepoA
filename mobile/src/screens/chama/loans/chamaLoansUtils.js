export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Date not available';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Date error';
  }
};

export const getLoanName = (item, currentUser) => {
  const borrowerName = item.borrower?.firstName || item.borrower?.lastName
    ? `${item.borrower.firstName || ''} ${item.borrower.lastName || ''}`.trim()
    : item.borrower?.fullName;

  if (borrowerName) return borrowerName;

  const applicantName = item.applicant?.first_name ||
    item.applicant?.firstName ||
    item.user?.first_name ||
    item.user?.firstName ||
    item.applicant?.name ||
    item.user?.name ||
    item.applicant_name ||
    item.user_name;

  if (applicantName) return applicantName;

  if (item.borrower_id === currentUser?.id) {
    const userName = `${currentUser.firstName || currentUser.first_name || currentUser.name || 'You'} ${currentUser.lastName || currentUser.last_name || ''}`.trim();
    return userName || 'You';
  }

  return 'Loading...';
};

export const getStatusColor = (status, colors) => {
  switch (status) {
    case 'pending':
      return colors.warning;
    case 'approved':
      return colors.info;
    case 'active':
      return colors.primary;
    case 'completed':
      return colors.success;
    case 'rejected':
      return colors.error;
    default:
      return colors.textSecondary;
  }
};

export const getLoanStatusStyles = (status, styles) => {
  switch (status) {
    case 'pending':
      return [styles.statusBadge, styles.statusBadgeWarning, styles.statusTextWarning];
    case 'approved':
      return [styles.statusBadge, styles.statusBadgeInfo, styles.statusTextInfo];
    case 'active':
      return [styles.statusBadge, styles.statusBadgePrimary, styles.statusTextPrimary];
    case 'completed':
      return [styles.statusBadge, styles.statusBadgeSuccess, styles.statusTextSuccess];
    case 'rejected':
      return [styles.statusBadge, styles.statusBadgeError, styles.statusTextError];
    default:
      return [styles.statusBadge, styles.statusBadgeMuted, styles.statusTextMuted];
  }
};

export const getActionStyle = (type, styles) => {
  switch (type) {
    case 'view':
      return [styles.actionButton, styles.actionButtonPrimary];
    case 'approve':
      return [styles.actionButton, styles.actionButtonSuccess];
    case 'reject':
      return [styles.actionButton, styles.actionButtonError];
    default:
      return [styles.actionButton, styles.actionButtonPrimary];
  }
};
