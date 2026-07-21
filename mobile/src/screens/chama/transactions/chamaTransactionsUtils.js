export const filters = [
  { id: 'all', name: 'All Records', icon: 'list' },
  { id: 'contribution', name: 'Contributions', icon: 'add-circle' },
  { id: 'welfare', name: 'Welfare', icon: 'heart' },
  { id: 'merry-go-round', name: 'Merry-Go-Round', icon: 'refresh-circle' },
  { id: 'loan', name: 'Loans', icon: 'card' },
  { id: 'withdrawal', name: 'Withdrawals', icon: 'remove-circle' },
  { id: 'penalty', name: 'Penalties', icon: 'warning' },
];

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'KES 0';
  }

  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatAmountOnly = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0';
  }

  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatUserName = (fullName) => {
  if (!fullName || fullName === 'Unknown Member') return fullName;

  const nameParts = fullName.trim().split(' ');
  if (nameParts.length >= 2) {
    return `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
  }

  return nameParts[0];
};

export const getTransactionUserName = (item, chamaMembers = []) => {
  if (item.metadata?.isAnonymous || item.metadata?.displayName === 'Anonymous') {
    return 'Anonymous';
  }

  if ((item.paymentMethod === 'cash') && item.metadata?.contributorId) {
    const contributor = chamaMembers.find(member =>
      member.id === item.metadata.contributorId ||
      member.user_id === item.metadata.contributorId
    );

    if (contributor) {
      const firstName = contributor.first_name || contributor.user?.first_name || '';
      const lastName = contributor.last_name || contributor.user?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || contributor.name || contributor.user?.name || 'Unknown Member';
    }
  }

  if (item.type === 'merry-go-round' || item.transaction_type === 'merry-go-round') {
    if (item.participant) {
      const participant = item.participant;
      const firstName = participant.first_name || participant.user?.first_name || '';
      const lastName = participant.last_name || participant.user?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) return fullName;
    }

    if (item.metadata?.participantId) {
      const participant = chamaMembers.find(member =>
        member.id === item.metadata.participantId ||
        member.user_id === item.metadata.participantId
      );
      if (participant) {
        const firstName = participant.first_name || participant.user?.first_name || '';
        const lastName = participant.last_name || participant.user?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) return fullName;
      }
    }
  }

  // Check nested user objects from backend responses
  const nestedUserObjects = [
    item.user,
    item.requester,
    item.beneficiary,
    item.contributor,
    item.applicant,
    item.creator,
    item.requester,
    item.payee,
    item.payer,
  ];

  for (const userObj of nestedUserObjects) {
    if (userObj) {
      const firstName = userObj.firstName || userObj.first_name || '';
      const lastName = userObj.lastName || userObj.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) return fullName;

      const userName = userObj.name || userObj.fullName || userObj.full_name || userObj.displayName;
      if (userName && userName.trim()) return userName.trim();
    }
  }

  // Check top-level name fields
  const topLevelName = item.name ||
                       item.fullName ||
                       item.full_name ||
                       item.displayName ||
                       item.contributor_name ||
                       item.member_name ||
                       item.applicant_name ||
                       item.requester_name ||
                       item.beneficiary_name;

  if (topLevelName && topLevelName.trim()) {
    return topLevelName.trim();
  }

  // Fallback: look up user in chamaMembers by various ID fields
  if (chamaMembers.length > 0) {
    const userIdFields = [
      item.user_id,
      item.userId,
      item.initiated_by,
      item.initiatedBy,
      item.initiatedById,
      item.contributed_by,
      item.contributedById,
      item.member_id,
      item.memberId,
      item.sender_id,
      item.recipient_id,
      item.createdBy,
      item.created_by,
      item.creator_id,
      item.createdById,
      item.requesterId,
      item.beneficiaryId,
      item.contributorId,
      item.borrowerId,
      item.borrower_id,
      item.applicant_id,
      item.payerUserId,
      item.payeeUserId,
    ];

    const transactionUserId = userIdFields.find(id => id);

    if (transactionUserId) {
      const member = chamaMembers.find(m =>
        m.user_id === transactionUserId ||
        m.id === transactionUserId ||
        m.user?.id === transactionUserId
      );

      if (member) {
        const user = member.user || {};
        const firstName = user.first_name || user.firstName ||
                         member.firstName || member.first_name ||
                         member.name?.split(' ')[0] || '';

        const lastName = user.last_name || user.lastName ||
                        member.lastName || member.last_name ||
                        member.name?.split(' ').slice(1).join(' ') || '';

        let fullName = member.fullName || member.full_name ||
                      user.fullName || user.full_name ||
                      member.name || user.name ||
                      `${firstName} ${lastName}`.trim();

        if (fullName && fullName.trim() && fullName.trim() !== 'undefined undefined') {
          return fullName.trim();
        }

        return user.email || member.email || `Member ${(member.user_id || member.id || '').slice(-4)}`;
      }
    }
  }

  return `Member ${(item.id || '').slice(-4)}`;
};

export const getTransactionAmount = (item) => {
  if (item.type === 'merry-go-round' || item.transaction_type === 'merry-go-round') {
    let amount = item.amount ||
                 item.transaction_amount ||
                 item.total_amount ||
                 item.contribution_amount ||
                 item.merry_go_round_amount ||
                 item.amount_per_round ||
                 0;

    if (amount === 0 && item.metadata) {
      amount = item.metadata.amount ||
               item.metadata.transaction_amount ||
               item.metadata.contribution_amount ||
               item.metadata.merry_go_round_amount ||
               0;
    }

    if (amount === 0) {
      return 0;
    }

    if (typeof amount === 'string') {
      amount = amount.replace(/[KES,\s]/g, '');
      amount = parseFloat(amount);
    }

    if (isNaN(amount) || amount === null || amount === undefined) {
      return 0;
    }

    return Math.abs(amount);
  }

  let amount = item.amount || item.transaction_amount || item.total_amount || 0;

  if (typeof amount === 'string') {
    amount = amount.replace(/[KES,\s]/g, '');
    amount = parseFloat(amount);
  }

  if (isNaN(amount) || amount === null || amount === undefined) {
    return 0;
  }

  return Math.abs(amount);
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Unknown Date';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

export const getTransactionIcon = (type) => {
  switch (type) {
    case 'contribution':
      return 'add-circle';
    case 'withdrawal':
      return 'remove-circle';
    case 'loan':
      return 'card';
    case 'expense':
      return 'receipt';
    default:
      return 'swap-horizontal';
  }
};

export const getTransactionColor = (type, colors) => {
  switch (type) {
    case 'contribution':
      return colors.success;
    case 'withdrawal':
      return colors.warning;
    case 'loan':
      return colors.info;
    case 'expense':
      return colors.error;
    default:
      return colors.textSecondary;
  }
};

export const getAmountColor = (type, colors) => {
  if (type === 'contribution') return colors.success;
  if (type === 'withdrawal') return colors.warning;
  return colors.text;
};

export const getShortTypeLabel = (type) => {
  const label = (type || '').toUpperCase();
  return label.length > 5 ? `${label.substring(0, 5)}...` : label;
};

export const getShortDescription = (item) => {
  const description = item.description || `${item.type} Transaction`;
  return description.length > 6 ? `${description.substring(0, 6)}...` : description;
};

export const getMemberName = (item) => {
  return item.name ||
    item.user?.name ||
    `${item.user?.first_name || ''} ${item.user?.last_name || ''}`.trim() ||
    'Unknown Member';
};

export const getMemberEmail = (item) => {
  return item.email || item.user?.email || '';
};
