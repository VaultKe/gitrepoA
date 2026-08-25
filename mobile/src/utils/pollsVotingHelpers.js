const getMemberName = (member) => {
  const user = member.user || {};
  const firstName = user.first_name || member.firstName || '';
  const lastName = user.last_name || member.lastName || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown Member';
};

const getMemberEmail = (member) => {
  const user = member.user || {};
  return user.email || member.email || 'No email';
};

const formatTableDate = (dateString) => {
  if (!dateString) return 'Unknown Date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    return 'Unknown Date';
  }
};

const getPollTypeColor = (type, colors) => {
  switch (type) {
    case 'general': return colors.info;
    case 'Election / Voting': return colors.warning;
    case 'financial_decision': return colors.success;
    default: return colors.textSecondary;
  }
};

const getStatusColor = (status, result, colors) => {
  if (status === 'completed') {
    return result === 'passed' ? colors.success : colors.error;
  }
  return colors.warning;
};

const getTotalVotesCast = (poll) => {
  if (!poll.options || !Array.isArray(poll.options)) return 0;
  return poll.options.reduce((total, option) => total + (option.vote_count || 0), 0);
};

const getTotalEligibleVoters = (poll, chamaMembers) => {
  return (chamaMembers || []).length;
};

const getVotePercentage = (voteCount, totalVotes) => {
  if (totalVotes === 0) return 0;
  return Math.round((voteCount / totalVotes) * 100);
};

const isPollFullyVoted = (poll, chamaMembers) => {
  const totalVotesCast = getTotalVotesCast(poll);
  const totalEligibleVoters = getTotalEligibleVoters(poll, chamaMembers);
  if (totalEligibleVoters === 0) return false;
  return totalVotesCast >= totalEligibleVoters;
};

const normalizePollItem = (item) => {
  if (item.source === 'poll') {
    return {
      ...item,
      type: item.poll_type || item.type || 'general',
      ends_at: item.end_date || item.ends_at,
      starts_at: item.start_date || item.starts_at,
      total_votes: item.total_votes_cast ?? item.total_votes ?? 0,
    };
  }
  return item;
};

const processPollItem = (item, chamaMembers) => {
  const isFullyVoted = isPollFullyVoted(item, chamaMembers);
  const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null;
  const now = Date.now();
  let timeRemaining = null;
  if (endsAt && item.status === 'active') {
    timeRemaining = Math.max(0, Math.floor((endsAt - now) / 1000));
  }

  if (isFullyVoted && item.status === 'active') {
    return {
      ...item,
      status: 'completed',
      result: 'completed_early',
      ends_at: new Date().toISOString(),
      isFullyVoted: true,
      completionStatus: 'Completed (100% participation)',
      timeRemaining: 0,
    };
  }

  return {
    ...item,
    isFullyVoted,
    completionStatus: isFullyVoted ? 'All votes cast' : null,
    timeRemaining,
  };
};

export {
  getMemberName,
  getMemberEmail,
  formatTableDate,
  getPollTypeColor,
  getStatusColor,
  getTotalVotesCast,
  getTotalEligibleVoters,
  getVotePercentage,
  isPollFullyVoted,
  normalizePollItem,
  processPollItem,
};
