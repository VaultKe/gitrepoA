export const getMemberNameFromTransaction = (transaction, chamaMembers = [], userInfo = {}) => {
  if (!transaction) return 'Unknown Member';

  let metadata;
  try {
    metadata = typeof transaction.metadata === 'string'
      ? JSON.parse(transaction.metadata)
      : transaction.metadata;

    if (metadata?.isAnonymous || metadata?.displayName === 'Anonymous') {
      return 'Anonymous';
    }
  } catch {}

  if (userInfo?.isPersonalTransaction) {
    return userInfo.name || 'User';
  }

  let transactionUserId = null;

  if (transaction.type === 'welfare' && transaction.requesterId) {
    transactionUserId = transaction.requesterId;
  } else if (transaction.type === 'merry-go-round') {
    transactionUserId = transaction.createdBy ||
                       transaction.created_by ||
                       transaction.contributorId ||
                       transaction.user_id ||
                       transaction.initiated_by;
  } else {
    transactionUserId = transaction.user_id || transaction.initiated_by ||
                     transaction.contributed_by || transaction.member_id;
  }

  if (transactionUserId && chamaMembers.length > 0) {
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

  if (transaction.type === 'welfare' && transaction.requester) {
    const firstName = transaction.requester.firstName || transaction.requester.first_name || '';
    const lastName = transaction.requester.lastName || transaction.requester.last_name || '';
    const fullName = transaction.requester.fullName || `${firstName} ${lastName}`.trim();

    if (fullName) return fullName;
    if (transaction.requester.email) return transaction.requester.email;
  }

  if (transaction.type === 'merry-go-round' && transaction.creator) {
    const firstName = transaction.creator.firstName || transaction.creator.first_name || '';
    const lastName = transaction.creator.lastName || transaction.creator.last_name || '';
    const fullName = transaction.creator.fullName || `${firstName} ${lastName}`.trim();

    if (fullName) return fullName;
    if (transaction.creator.email) return transaction.creator.email;
  }

  if (transaction.user?.firstName || transaction.user?.lastName ||
      transaction.user?.first_name || transaction.user?.last_name) {
    const firstName = transaction.user.firstName || transaction.user.first_name || '';
    const lastName = transaction.user.lastName || transaction.user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName && fullName !== 'undefined undefined' && fullName !== ' ') {
      return fullName;
    }
  }

  if (transaction.user?.name && transaction.user.name.trim()) {
    return transaction.user.name.trim();
  }

  if (transaction.contributor_name?.trim()) {
    return transaction.contributor_name.trim();
  }

  if (transaction.member_name?.trim()) {
    return transaction.member_name.trim();
  }

  if (transaction.user?.email) {
    return transaction.user.email;
  }

  return `Member ${(transactionUserId || transaction.id || '').slice(-4)}`;
};